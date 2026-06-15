import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts, getPostUrl, siteUrl } from "@/app/lib/blogPosts";

const blogDescription =
  "Guides for gig drivers who want to know what they actually make.";
const ogImage = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  title: "GigAxios Blog | Guides for Gig Drivers",
  description: blogDescription,
  alternates: {
    canonical: `${siteUrl}/blog`,
  },
  openGraph: {
    title: "GigAxios Blog",
    description: blogDescription,
    url: `${siteUrl}/blog`,
    siteName: "GigAxios",
    type: "website",
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
    title: "GigAxios Blog",
    description: blogDescription,
    images: [ogImage],
  },
};

export default function BlogIndexPage() {
  const [featuredPost, ...posts] = blogPosts;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "GigAxios Blog",
    description: blogDescription,
    url: `${siteUrl}/blog`,
    isPartOf: {
      "@type": "WebSite",
      name: "GigAxios",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "Blog",
      name: "GigAxios Blog",
      blogPost: blogPosts.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        url: getPostUrl(post.slug),
        datePublished: post.publishDate,
        dateModified: post.updatedDate ?? post.publishDate,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="min-h-screen bg-[#020814] text-white">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(0,102,255,0.34),transparent_31%),radial-gradient(circle_at_18%_24%,rgba(14,165,233,0.18),transparent_25%),linear-gradient(135deg,#020814_0%,#031329_56%,#061a3a_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#020814] to-transparent" />

          <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-between">
              <Link href="/" className="text-3xl font-extrabold tracking-tight">
                Gig<span className="text-blue-400">A</span>xios
              </Link>
              <div className="flex items-center gap-5 text-sm font-semibold text-slate-200">
                <Link href="/" className="transition hover:text-white">
                  Home
                </Link>
                <Link
                  href="/login"
                  className="rounded-full bg-blue-500 px-5 py-3 text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
                >
                  Start free
                </Link>
              </div>
            </nav>

            <div className="max-w-4xl pb-14 pt-16 md:pb-20 md:pt-24">
              <p className="inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-200">
                Know What You Actually Make.
              </p>
              <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
                GigAxios Blog
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                Guides for gig drivers who want to know what they actually
                make.
              </p>
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="group grid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 transition hover:border-sky-300/50 md:grid-cols-[0.95fr_1.05fr]"
            >
              <div className="bg-[linear-gradient(135deg,#0b2a64_0%,#0ea5e9_58%,#60a5fa_100%)] p-8 md:p-10">
                <p className="text-sm font-extrabold uppercase tracking-wide text-sky-100">
                  Featured Article
                </p>
                <div className="mt-20 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm font-bold text-sky-100">
                    {featuredPost.category}
                  </p>
                  <p className="mt-2 text-sm text-slate-100">
                    {featuredPost.readTime}
                  </p>
                </div>
              </div>
              <div className="p-8 md:p-10">
                <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                  {featuredPost.title}
                </h2>
                <p className="mt-5 text-base leading-7 text-slate-300">
                  {featuredPost.description}
                </p>
                <p className="mt-8 text-sm font-extrabold text-sky-200 transition group-hover:text-white">
                  Read the guide
                </p>
              </div>
            </Link>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-xl shadow-black/20 transition hover:border-sky-300/50 hover:bg-white/[0.08]"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs font-extrabold uppercase tracking-wide">
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-sky-200">
                      {post.category}
                    </span>
                    <span className="text-slate-400">{post.readTime}</span>
                  </div>
                  <h2 className="mt-5 text-2xl font-extrabold leading-snug text-white">
                    {post.title}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {post.description}
                  </p>
                  <p className="mt-6 text-sm font-extrabold text-sky-200 transition group-hover:text-white">
                    Read article
                  </p>
                </Link>
              ))}
            </div>

            <div className="mt-16 rounded-3xl border border-blue-400/20 bg-[#041227] p-8 shadow-2xl shadow-blue-950/30 sm:p-10">
              <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight">
                    Stop guessing what you make.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                    Track mileage, fuel, vehicle expenses, tips, and true net
                    profit with GigAxios.
                  </p>
                </div>
                <Link
                  href="/"
                  className="rounded-2xl bg-blue-500 px-7 py-4 text-center font-extrabold text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-400"
                >
                  Start tracking with GigAxios
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
