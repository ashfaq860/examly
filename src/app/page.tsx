import Header from '@/components/Header';
import dynamic from 'next/dynamic';
import HomeClientWrapper from './HomeClientWrapper';

// Lazy load Footer to improve initial page load
const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: true,
  loading: () => <div style={{ height: '200px' }} />,
});

export default function Home() {
  return (
    <>
      <Header />

      {/* Client-only wrapper for CubeSlider + scroll effects */}
      <HomeClientWrapper />

      <Footer />
    </>
  );
}
