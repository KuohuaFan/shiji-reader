import { ArrowRight, Bot, BookOpen, Flag, Languages, Network, ScrollText } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { manifest, formatNumber } from "@/lib/content";
import { reviewHref } from "@/lib/site";

interface LandingProps {
  onStart: (volume?: number) => void;
}

const categoryGlyphs: Record<string, string> = {
  本紀: "紀",
  表: "表",
  書: "書",
  世家: "家",
  列傳: "傳",
};

export default function Landing({ onStart }: LandingProps) {
  return (
    <main className="landing-shell min-h-screen overflow-hidden">
      <div className="grain" aria-hidden="true" />
      <div className="landing-rule landing-rule-left" aria-hidden="true" />
      <div className="landing-rule landing-rule-right" aria-hidden="true" />

      <section className="relative z-10 mx-auto flex min-h-[86vh] w-full max-w-6xl flex-col px-6 pb-14 pt-10 md:px-12 md:pt-16">
        <header className="flex items-center justify-between border-b border-ink/10 pb-5 text-xs tracking-[0.2em] text-ink-muted">
          <div className="flex items-center gap-3">
            <BrandLogo className="brand-logo--compact" />
            <span>太史公書 · 線上讀本</span>
          </div>
          <span className="hidden sm:block">第三版 · 數位人文與協作校勘</span>
        </header>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[0.86fr_1.14fr] lg:py-20">
          <div className="hero-mark-wrap" aria-hidden="true">
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <BrandLogo className="brand-logo--landing" decorative />
            <div className="hero-year">紀事始於黃帝<br />迄於漢武帝</div>
          </div>

          <div className="max-w-2xl">
            <p className="eyebrow mb-6">究天人之際 · 通古今之變 · 成一家之言</p>
            <h1 className="display-title text-7xl leading-none sm:text-8xl md:text-9xl">史記</h1>
            <p className="mt-5 font-serif text-lg tracking-[0.32em] text-cinnabar sm:text-xl">
              〔西漢〕司馬遷 撰
            </p>
            <p className="mt-9 max-w-xl font-serif text-[17px] leading-9 text-ink-soft sm:text-lg">
              中國第一部紀傳體通史。全書以十二本紀、十表、八書、三十世家與七十列傳，
              縱貫上古傳說至漢武帝時代，在人物抉擇與制度變遷之間書寫歷史。
            </p>

            <div className="edition-strip mt-8">
              <span>全文 {manifest.chapterCount} 篇</span>
              <i />
              <span>{formatNumber(manifest.totalChars)} 字</span>
              <i />
              <span>五體完備</span>
              <i />
              <span>三家註 · 人物圖 · 年代軸 · AI</span>
            </div>

            <button className="start-button group mt-10" onClick={() => onStart(1)}>
              <BookOpen size={18} strokeWidth={1.7} />
              開始閱讀
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" size={17} />
            </button>
          </div>
        </div>

        <div className="category-ribbon grid grid-cols-2 border-y border-ink/10 sm:grid-cols-5">
          {manifest.categories.map((category, index) => (
            <button
              key={category.name}
              className="category-entry group"
              onClick={() => onStart(category.start)}
            >
              <span className="category-count">{String(index + 1).padStart(2, "0")}</span>
              <span className="category-glyph">{categoryGlyphs[category.name]}</span>
              <span className="category-meta">
                <strong>{category.name}</strong>
                <small>{category.count} 篇</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-t border-ink/10 bg-paper-deep/45">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm text-ink-muted sm:grid-cols-2 lg:grid-cols-5 md:px-12">
          <div className="flex gap-4">
            <ScrollText className="mt-0.5 shrink-0 text-cinnabar" size={20} strokeWidth={1.5} />
            <p className="leading-7"><b className="font-medium text-ink">一百三十篇完整收錄</b><br />以分篇資料載入，長篇年表亦保留表格結構。</p>
          </div>
          <div className="flex gap-4">
            <ScrollText className="mt-0.5 shrink-0 text-cinnabar" size={20} strokeWidth={1.5} />
            <p className="leading-7"><b className="font-medium text-ink">三家註與校勘</b><br />集解、索隱、正義分色閱讀，校勘註腳另層呈現。</p>
          </div>
          <div className="flex gap-4">
            <Languages className="mt-0.5 shrink-0 text-cinnabar" size={20} strokeWidth={1.5} />
            <p className="leading-7"><b className="font-medium text-ink">逐段白話與導讀</b><br />一百三十篇逐段對照，另附篇旨、脈絡及人物解說。</p>
          </div>
          <div className="flex gap-4">
            <Bot className="mt-0.5 shrink-0 text-cinnabar" size={20} strokeWidth={1.5} />
            <p className="leading-7"><b className="font-medium text-ink">進階 AI 問答</b><br />可指定三家註來源與歷史時期，答案附實際引文。</p>
          </div>
          <div className="flex gap-4 sm:col-span-2 lg:col-span-1">
            <Network className="mt-0.5 shrink-0 text-cinnabar" size={20} strokeWidth={1.5} />
            <p className="leading-7"><b className="font-medium text-ink">人物圖與年代軸</b><br />依篇呈現人物連結與史事順序，每項附原文依據。</p>
          </div>
        </div>
        <div className="landing-editorial-link"><Flag size={14} /><span>讀者可在每篇側欄提交錯誤回報；管理員由 <a href={reviewHref()}>人工學術校訂台</a> 覆核後發布。</span></div>
      </section>
    </main>
  );
}
