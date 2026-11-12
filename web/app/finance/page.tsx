import type { Metadata } from "next";
import { Feed } from "@/components/Feed";
import { Header } from "@/components/Header";
import { FINANCE_CATEGORIES, getStories } from "@/lib/data";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  const stories = getStories().filter((s) => FINANCE_CATEGORIES.includes(s.category));
  return (
    <>
      <Header active="/finance/" />
      <Feed stories={stories} preset="finance" />
    </>
  );
}
