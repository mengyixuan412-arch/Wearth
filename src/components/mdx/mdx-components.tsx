import { MdxA } from "@/components/mdx/mdx-a";
import { MdxH1, MdxH2, MdxH3, MdxH4, MdxH5, MdxH6 } from "@/components/mdx/mdx-headings";
import { ImageGrid, MdxImg } from "@/components/mdx/mdx-img";
import { DownloadButton, MdxPre } from "@/components/mdx/mdx-pre";

export const mdxComponents = {
  a: MdxA,
  h1: MdxH1,
  h2: MdxH2,
  h3: MdxH3,
  h4: MdxH4,
  h5: MdxH5,
  h6: MdxH6,
  img: MdxImg,
  pre: MdxPre,
  MdxImg,
  ImageGrid,
  DownloadButton,
  iframe: (props: React.IframeHTMLAttributes<HTMLIFrameElement>) => <iframe {...props} />,
};
