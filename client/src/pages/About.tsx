import Landing from "@/components/Landing";
import { chapterHref } from "@/lib/site";

export default function About() {
  return <Landing onStart={(volume = 1) => { window.location.href = chapterHref(volume); }} />;
}
