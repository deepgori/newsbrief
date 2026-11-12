import { Feed } from "@/components/Feed";
import { Header } from "@/components/Header";
import { getStories } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Header active="/" />
      <Feed stories={getStories()} preset="top" />
    </>
  );
}
