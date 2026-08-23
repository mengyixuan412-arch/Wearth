"""Generate an inflated-tube script model (a "hello"-style word) as GLB.

Run headless:
  Blender --background --python tools/make_script_model.py -- \
      --text hello --font "/path/Font.ttc" --out public/model/hello.glb

The original asset is a font outline swept with a round profile, so this
mirrors that: text -> curve -> round bevel -> mesh.
"""
import argparse
import math
import sys

import bpy
import bmesh
from mathutils import Vector

# Matches the original hello.gltf once its node transforms are baked in.
TARGET_HEIGHT = 0.2428
# Original tube diameter / total height.
TARGET_THICKNESS_RATIO = 0.679
# Original width once its node transforms are baked in.
TARGET_WIDTH = 0.7007


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--font", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--bevel-resolution", type=int, default=6)
    p.add_argument("--curve-resolution", type=int, default=8)
    p.add_argument("--spacing", type=float, default=1.0)
    p.add_argument("--height", type=float, default=TARGET_HEIGHT)
    p.add_argument("--fit", choices=("height", "width"), default="height")
    p.add_argument("--width-target", type=float, default=TARGET_WIDTH)
    p.add_argument("--thickness-ratio", type=float, default=TARGET_THICKNESS_RATIO)
    p.add_argument("--remesh", type=float, default=0.22,
                   help="voxel size as a fraction of tube radius; 0 disables")
    p.add_argument("--target-verts", type=int, default=24000)
    p.add_argument("--lead-thickness-ratio", type=float, default=None,
                   help="separate tube ratio for the first glyph; defaults to --thickness-ratio")
    p.add_argument("--solid", action="store_true",
                   help="Extrude the filled glyph and round its rim instead of sweeping the outline. "
                        "A script font's filled shape is already one stroke, so this yields a single "
                        "tube per stroke — sweeping the outline instead runs one tube down each side "
                        "of every stroke, which reads as a doubled letterform when they do not fuse.")
    p.add_argument("--extrude-ratio", type=float, default=0.055,
                   help="--solid only: half-depth of the extrusion, as a fraction of glyph height.")
    p.add_argument("--round-ratio", type=float, default=0.022,
                   help="--solid only: rim rounding radius, as a fraction of glyph height.")
    p.add_argument("--lead-width", type=float, default=1.0,
                   help="horizontal stretch applied to the first glyph (1.0 = untouched)")
    return p.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_text(args):
    curve = bpy.data.curves.new(name="ScriptWord", type="FONT")
    curve.body = args.text
    curve.font = bpy.data.fonts.load(args.font)
    curve.space_character = args.spacing
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.resolution_u = args.curve_resolution

    obj = bpy.data.objects.new("ScriptWord", curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def spline_x_range(spline):
    points = spline.bezier_points if spline.type == "BEZIER" else spline.points
    xs = [p.co.x for p in points]
    return (min(xs), max(xs)) if xs else (0.0, 0.0)


def lead_spline_indices(curve):
    """Indices of the splines that make up the leftmost glyph.

    A glyph outline arrives as several splines (outer contour plus counters),
    so group them by overlapping X ranges and take the first cluster. Indices
    are used rather than spline objects because duplicating the object creates
    fresh spline instances that would never compare equal.
    """
    ranges = [(index, *spline_x_range(spline)) for index, spline in enumerate(curve.splines)]
    ranges.sort(key=lambda item: item[1])
    if not ranges:
        return set()
    group = {ranges[0][0]}
    reach = ranges[0][2]
    for index, lo, hi in ranges[1:]:
        if lo >= reach:
            break
        group.add(index)
        reach = max(reach, hi)
    return group


def map_spline_points(curve, fn):
    """Applies fn to every control point (and bezier handle) of a curve.

    Handles must be switched to FREE first: AUTO/ALIGNED handles are re-derived
    by Blender whenever a point moves, and the re-alignment swings the opposite
    handle off-axis — an X-only stretch would then also displace points in Y.
    """
    for spline in curve.splines:
        if spline.type == "BEZIER":
            for point in spline.bezier_points:
                point.handle_left_type = "FREE"
                point.handle_right_type = "FREE"
            for point in spline.bezier_points:
                point.co = fn(point.co)
                point.handle_left = fn(point.handle_left)
                point.handle_right = fn(point.handle_right)
        else:
            for point in spline.points:
                moved = fn(Vector((point.co.x, point.co.y, point.co.z)))
                point.co = (moved.x, moved.y, moved.z, point.co.w)


def curve_x_bounds(curve):
    lo, hi = 1e18, -1e18
    for spline in curve.splines:
        points = spline.bezier_points if spline.type == "BEZIER" else spline.points
        for point in points:
            lo = min(lo, point.co.x)
            hi = max(hi, point.co.x)
    return lo, hi


def remove_spline_indices(obj, indices):
    curve = obj.data
    for index in sorted(indices, reverse=True):
        curve.splines.remove(curve.splines[index])


def outline_height(obj):
    """Height of the bare glyph outline, before any bevel is applied."""
    bpy.ops.object.convert(target="MESH")
    mesh_obj = bpy.context.active_object
    zs = [v.co.y for v in mesh_obj.data.vertices]
    return (max(zs) - min(zs)) if zs else 1.0


def main():
    args = parse_args()
    clear_scene()

    # Pass 1: measure the outline so the bevel radius can be derived from it.
    probe = build_text(args)
    base_h = outline_height(probe)
    bpy.ops.object.delete()

    # total = outline + 2r  and  2r / total = ratio  =>  r = outline*ratio / (2*(1-ratio))
    ratio = min(max(args.thickness_ratio, 0.01), 0.95)
    radius = base_h * ratio / (2.0 * (1.0 - ratio))

    # Pass 2: the real object, swept with a round profile.
    obj = build_text(args)
    bpy.ops.object.convert(target="CURVE")
    obj = bpy.context.active_object

    lead_ratio = args.lead_thickness_ratio
    lead_radius = radius
    if lead_ratio is not None:
        lr = min(max(lead_ratio, 0.01), 0.95)
        lead_radius = base_h * lr / (2.0 * (1.0 - lr))

    def apply_bevel(target, depth):
        # A round sweep needs a 3D curve; font curves default to 2D (flat fill).
        target.data.dimensions = "3D"
        target.data.bevel_depth = depth
        target.data.bevel_resolution = args.bevel_resolution
        target.data.use_fill_caps = True
        target.data.fill_mode = "FULL"

    if args.solid:
        obj.data.dimensions = "2D"
        obj.data.fill_mode = "BOTH"
        obj.data.extrude = base_h * args.extrude_ratio
        obj.data.bevel_depth = base_h * args.round_ratio
        obj.data.bevel_resolution = args.bevel_resolution
        bpy.ops.object.convert(target="MESH")
        obj = bpy.context.active_object
        radius = max(base_h * args.round_ratio, 1e-6)
        needs_split = False
    else:
        needs_split = abs(args.lead_width - 1.0) > 1e-6 or (lead_ratio is not None and abs(lead_radius - radius) > 1e-9)
    if args.solid:
        pass
    elif not needs_split:
        apply_bevel(obj, radius)
        bpy.ops.object.convert(target="MESH")
        obj = bpy.context.active_object
    else:
        # The first glyph gets its own tube radius, so split the outline in two,
        # sweep each separately, then join the resulting meshes back together.
        total = len(obj.data.splines)
        lead_idx = lead_spline_indices(obj.data)
        body_idx = set(range(total)) - lead_idx

        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.duplicate()
        lead = bpy.context.active_object

        remove_spline_indices(lead, body_idx)
        remove_spline_indices(obj, lead_idx)

        # Widen the lead glyph before beveling: stretching after the sweep would
        # squash the round profile into an ellipse. The rest of the word slides
        # right by the same amount so letter spacing is preserved.
        if abs(args.lead_width - 1.0) > 1e-6:
            lo, hi = curve_x_bounds(lead.data)
            grow = args.lead_width
            map_spline_points(lead.data, lambda v: Vector(((v.x - lo) * grow + lo, v.y, v.z)))
            shift = (hi - lo) * (grow - 1.0)
            map_spline_points(obj.data, lambda v: Vector((v.x + shift, v.y, v.z)))
            print("LEAD_WIDEN factor=%.2f shift=%.4f" % (grow, shift))

        def yr(c):
            lo_, hi_ = 1e18, -1e18
            for sp in c.splines:
                pts = sp.bezier_points if sp.type == "BEZIER" else sp.points
                for pt in pts:
                    lo_ = min(lo_, pt.co.y); hi_ = max(hi_, pt.co.y)
            return lo_, hi_
        ly = yr(lead.data); by = yr(obj.data)
        print("SPLIT lead_splines=%d body_splines=%d leadY=[%.3f,%.3f] bodyY=[%.3f,%.3f]"
              % (len(lead_idx), len(body_idx), ly[0], ly[1], by[0], by[1]))

        apply_bevel(lead, lead_radius)
        apply_bevel(obj, radius)

        for target in (lead, obj):
            bpy.ops.object.select_all(action="DESELECT")
            target.select_set(True)
            bpy.context.view_layer.objects.active = target
            bpy.ops.object.convert(target="MESH")

        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        lead.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.join()
        obj = bpy.context.active_object

    radius = min(radius, lead_radius)

    # A round sweep over font outlines self-intersects wherever the bevel
    # radius exceeds the local curvature, which shows up as shards. A voxel
    # remesh rebuilds one clean watertight skin and gives the inflated look.
    if args.remesh > 0:
        mod = obj.modifiers.new("Remesh", "REMESH")
        mod.mode = "VOXEL"
        mod.voxel_size = radius * args.remesh
        mod.adaptivity = 0.0
        bpy.ops.object.modifier_apply(modifier=mod.name)

        if args.target_verts > 0 and len(obj.data.vertices) > args.target_verts:
            dec = obj.modifiers.new("Decimate", "DECIMATE")
            dec.decimate_type = "COLLAPSE"
            dec.ratio = args.target_verts / len(obj.data.vertices)
            bpy.ops.object.modifier_apply(modifier=dec.name)

        smooth = obj.modifiers.new("Smooth", "SMOOTH")
        smooth.factor = 0.5
        smooth.iterations = 2
        bpy.ops.object.modifier_apply(modifier=smooth.name)
    else:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=radius * 1e-3)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()

    for poly in obj.data.polygons:
        poly.use_smooth = True

    # The glass shader samples a screen-space texture, but the source asset
    # carries UVs, so keep the attribute set identical.
    if not obj.data.uv_layers:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66))
        bpy.ops.object.mode_set(mode="OBJECT")

    # Normalise while still in Blender's own frame: X = advance, Y = glyph
    # height, Z = tube thickness. Doing this after the Y-up rotation would
    # measure the wrong axis.
    coords = [Vector(v.co) for v in obj.data.vertices]
    lo = Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
    hi = Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
    print("PRENORM x=%.4f y=%.4f z=%.4f  radius=%.5f" % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, radius))
    centre = (lo + hi) / 2.0
    if args.fit == "width":
        factor = args.width_target / max(hi.x - lo.x, 1e-9)
    else:
        factor = args.height / max(hi.y - lo.y, 1e-9)

    for v in obj.data.vertices:
        v.co = (Vector(v.co) - centre) * factor
    obj.data.update()

    coords = [Vector(v.co) for v in obj.data.vertices]
    size = Vector((
        max(c.x for c in coords) - min(c.x for c in coords),
        max(c.y for c in coords) - min(c.y for c in coords),
        max(c.z for c in coords) - min(c.z for c in coords),
    ))

    # Stand it up: Blender is Z-up, glTF is Y-up, so +90d about X puts the
    # lettering in the exported XY plane facing +Z.
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="NONE",
    )

    print("RESULT verts=%d bbox=%.4f,%.4f,%.4f aspect=%.3f thickness_ratio=%.3f" % (
        len(obj.data.vertices), size.x, size.y, size.z, size.x / size.y, size.z / size.y,
    ))


main()
