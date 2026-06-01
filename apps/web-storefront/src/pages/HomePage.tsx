import { PageTransition } from '../components/layout/PageTransition.js';

/**
 * Homepage stub — overwritten by Wave 6 (04-07).
 */
export default function HomePage() {
  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-xl font-semibold text-grovio-text">Home</h1>
      </div>
    </PageTransition>
  );
}
