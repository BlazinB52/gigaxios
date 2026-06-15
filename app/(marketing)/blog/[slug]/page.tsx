import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  blogPosts,
  getBlogPost,
  getPostUrl,
  getRelatedPosts,
  siteUrl,
} from "@/app/lib/blogPosts";

const ogImage = `${siteUrl}/og-image.png`;

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: "Article Not Found | GigAxios",
    };
  }

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    keywords: post.keywords,
    alternates: {
      canonical: getPostUrl(post.slug),
    },
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      url: getPostUrl(post.slug),
      siteName: "GigAxios",
      type: "article",
      publishedTime: post.publishDate,
      modifiedTime: post.updatedDate ?? post.publishDate,
      authors: ["GigAxios"],
      tags: post.keywords,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 600,
          alt: "GigAxios - Know What You Actually Make",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle,
      description: post.seoDescription,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(post.slug);
  const articleUrl = getPostUrl(post.slug);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: ogImage,
    datePublished: post.publishDate,
    dateModified: post.updatedDate ?? post.publishDate,
    author: {
      "@type": "Organization",
      name: "GigAxios",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "GigAxios",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/Full_Logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    keywords: post.keywords.join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="min-h-screen bg-[#020814] text-white">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_12%,rgba(0,102,255,0.32),transparent_32%),radial-gradient(circle_at_14%_25%,rgba(14,165,233,0.16),transparent_25%),linear-gradient(135deg,#020814_0%,#031329_58%,#061a3a_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#020814] to-transparent" />

          <div className="relative mx-auto max-w-4xl px-5 py-6 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-between">
              <Link href="/" className="text-3xl font-extrabold tracking-tight">
                Gig<span className="text-blue-400">A</span>xios
              </Link>
              <Link
                href="/blog"
                className="text-sm font-bold text-slate-200 transition hover:text-white"
              >
                Back to blog
              </Link>
            </nav>

            <div className="pb-14 pt-14 md:pb-20 md:pt-20">
              <div className="flex flex-wrap items-center gap-3 text-xs font-extrabold uppercase tracking-wide">
                <span className="rounded-full bg-blue-500/15 px-3 py-1 text-sky-200">
                  {post.category}
                </span>
                <time dateTime={post.publishDate} className="text-slate-300">
                  {formatDate(post.publishDate)}
                </time>
                <span className="text-slate-300">{post.readTime}</span>
              </div>

              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
                {post.title}
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-200 sm:text-xl">
                {post.description}
              </p>
            </div>
          </div>
        </section>

        <article className="px-5 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="lg:sticky lg:top-8 lg:self-start">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm font-extrabold text-white">
                  Table of contents
                </p>
                <nav className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
                  {post.sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="transition hover:text-sky-200"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-10">
                <div className="space-y-5 text-lg leading-8 text-slate-200">
                  {post.intro.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                <div className="mt-10 space-y-12">
                  {post.sections.map((section) => (
                    <section key={section.id} id={section.id}>
                      <h2 className="text-3xl font-extrabold tracking-tight text-white">
                        {section.title}
                      </h2>
                      <div className="mt-5 space-y-5 text-base leading-8 text-slate-300">
                        {section.paragraphs.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                      {section.bullets ? (
                        <ul className="mt-5 grid gap-3 text-sm font-semibold text-slate-200 sm:grid-cols-2">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3"
                            >
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  ))}
                </div>

                {post.faqs ? (
                  <section className="mt-12">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white">
                      Common Questions
                    </h2>
                    <div className="mt-5 grid gap-4">
                      {post.faqs.map((faq) => (
                        <div
                          key={faq.question}
                          className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"
                        >
                          <h3 className="text-lg font-extrabold text-white">
                            {faq.question}
                          </h3>
                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="mt-12 rounded-3xl border border-blue-400/20 bg-[#041227] p-6 sm:p-8">
                  <h2 className="text-3xl font-extrabold tracking-tight">
                    Stop guessing what you make.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                    GigAxios helps you track mileage, fuel, vehicle expenses,
                    tips, and true net profit so every shift has a clearer
                    bottom line.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/"
                      className="rounded-2xl bg-blue-500 px-6 py-4 text-center font-extrabold text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-400"
                    >
                      Start tracking with GigAxios
                    </Link>
                    <Link
                      href="/blog"
                      className="rounded-2xl border border-white/20 px-6 py-4 text-center font-bold text-slate-100 transition hover:border-sky-300 hover:text-white"
                    >
                      Read more guides
                    </Link>
                  </div>
                </section>
              </div>

              <section className="mt-10">
                <h2 className="text-2xl font-extrabold tracking-tight text-white">
                  Related articles
                </h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {relatedPosts.map((relatedPost) => (
                    <Link
                      key={relatedPost.slug}
                      href={`/blog/${relatedPost.slug}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-sky-300/50 hover:bg-white/[0.08]"
                    >
                      <p className="text-xs font-extrabold uppercase tracking-wide text-sky-200">
                        {relatedPost.category}
                      </p>
                      <h3 className="mt-3 text-base font-extrabold leading-6 text-white">
                        {relatedPost.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {relatedPost.readTime}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
