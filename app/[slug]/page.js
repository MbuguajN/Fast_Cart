import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageBySlug, getAllPages } from '@/lib/pages';
import Footer from '@/components/Footer';

export async function generateStaticParams() {
  const pages = getAllPages();
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) return { title: 'Page Not Found | LiquorDash' };
  return {
    title: `${page.title} | LiquorDash`,
    description: `Official ${page.title} for Happy Hour / LiquorDash drinks delivery service.`,
  };
}

export default async function StaticPage({ params }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#840037] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white hover:text-white/80 transition-colors bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Store</span>
          </Link>

          <Link href="/" className="flex items-center">
            <span className="text-white font-extrabold text-lg sm:text-xl tracking-wider uppercase">
              HAPPY HOUR!
            </span>
          </Link>

          <div className="w-20" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 shadow-sm border border-gray-200/80">
          <div className="border-b border-gray-100 pb-6 mb-8">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#840037] bg-pink-50 px-3 py-1 rounded-full">
              Official Policy
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mt-3 tracking-tight">
              {page.title}
            </h1>
            <p className="text-xs text-gray-400 mt-2">
              Last updated: {new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* WordPress HTML Content */}
          <div
            className="prose prose-sm sm:prose-base max-w-none text-gray-700 leading-relaxed space-y-4 wp-content-rendered"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
