import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HomeClientWrapper from './HomeClientWrapper';

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
