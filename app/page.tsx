import Nav from "@/components/Nav";
import TerrainBackground from "@/components/TerrainBackgroundLazy";
import Hero from "@/components/Hero";
import Manifesto from "@/components/Manifesto";
import HowItWorks from "@/components/HowItWorks";
import Models from "@/components/Models";
import AgentsScroll from "@/components/AgentsScroll";
import Crews from "@/components/Crews";
import Stats from "@/components/Stats";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <TerrainBackground />
      <Nav />
      <main>
        {/* Atmospheric flythrough lives behind the hero + manifesto */}
        <Hero />
        <Manifesto />
        {/* Terrain has flown out; solid sections take over */}
        <div className="page-solid">
          <HowItWorks />
          <Models />
          <AgentsScroll />
          <Crews />
          <Stats />
          <Pricing />
          <FAQ />
          <CTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
