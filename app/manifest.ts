import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "邮件回复助手",
    short_name: "回复助手",
    description: "用你的语气生成邮件和即时消息回复。",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfa",
    theme_color: "#f7faf8",
    lang: "zh-CN"
  };
}
