import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CloudUpload,
  Eye,
  Heart,
  House,
  Leaf,
  PiggyBank,
  Sprout,
  Image,
  Upload,
} from "lucide-react";
import { buildPageHead } from "@/lib/page-head";
import "@/greenplan.css";

export const Route = createFileRoute("/_marketing/")({
  head: () =>
    buildPageHead({
      title: "GreenPlan — Design Your Yard Before You Build It",
      description:
        "Upload your yard photo and plan plants, patios and outdoor spaces. Preview your landscape design before you buy or build.",
      path: "/",
    }),
  component: LandingPage,
});
const ideas = [
  ["Small Yards", "Make the most of your space"],
  ["Patios", "Create your outdoor living room"],
  ["Raised Beds", "Grow your own food"],
  ["Vegetable Gardens", "Plan your harvest"],
  ["Garden Borders", "Add color and structure"],
  ["Outdoor Furniture", "Style your space"],
];
const steps = [
  {
    icon: CloudUpload,
    title: "Upload Your Yard",
    text: "Add a photo of your yard, patio or outdoor space.",
  },
  {
    icon: Sprout,
    title: "Place & Arrange",
    text: "Place plants, furniture and landscape elements.",
  },
  {
    icon: Image,
    title: "Preview Your Design",
    text: "See your idea take shape before you buy or build.",
  },
];
function LandingPage() {
  return (
    <div className="gp">
      <header className="gp-header gp-container">
        <Link to="/" className="gp-brand">
          <Sprout aria-hidden="true" />
          GreenPlan
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How It Works</a>
          <a href="#examples">Examples</a>
          <a href="#why-greenplan">Why GreenPlan</a>
        </nav>
        <Link to="/design" className="gp-button gp-header-cta">
          Start Designing <ArrowRight size={15} />
        </Link>
      </header>
      <section className="gp-hero gp-container">
        <div className="gp-hero-copy">
          <span className="gp-badge">Visual Landscape Planner</span>
          <h1>
            Design Your Yard
            <br />
            Before You Build It
          </h1>
          <p>
            Upload a photo of your yard and place plants, patios and outdoor elements. See your
            design before you buy or dig.
          </p>
          <Link to="/design" className="gp-button gp-upload">
            <Upload size={20} />
            Start Your Yard Design
            <ArrowRight size={18} />
          </Link>
          <small>
            No signup required <span>·</span> Explore the design editor
          </small>
          <div className="gp-benefits">
            <div>
              <Leaf />
              <p>
                <strong>Easy to Use</strong>
                <span>Plan at your own pace</span>
              </p>
            </div>
            <div>
              <Eye />
              <p>
                <strong>Visual Planning</strong>
                <span>See your vision</span>
              </p>
            </div>
            <div>
              <House />
              <p>
                <strong>For Any Space</strong>
                <span>Small yards to backyards</span>
              </p>
            </div>
          </div>
        </div>
        <div
          className="gp-hero-art"
          role="img"
          aria-label="Design concept showing a lawn before planning and a furnished garden after planning"
        >
          <div className="gp-photo-crop" />
          <span className="gp-concept">Illustrative design concept</span>
        </div>
      </section>
      <section className="gp-how gp-container" id="how-it-works">
        <div className="gp-section-heading">
          <h2>How It Works</h2>
          <p>A little imagination. A clearer plan for your outdoor space.</p>
        </div>
        <div className="gp-steps">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div className="gp-step" key={title}>
              <div className="gp-step-icon">
                <span>{i + 1}</span>
                <Icon size={34} strokeWidth={1.6} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              {i < 2 && <ArrowRight className="gp-step-arrow" size={24} strokeWidth={1} />}
            </div>
          ))}
        </div>
      </section>
      <section className="gp-examples gp-container" id="examples">
        <div className="gp-section-heading">
          <h2>Design Ideas for Every Space</h2>
          <p>
            From cozy patios to productive gardens, find a starting point for your next project.
          </p>
        </div>
        <div className="gp-ideas">
          {ideas.map(([name, description], i) => (
            <Link to="/design" className="gp-idea" key={name}>
              <div className={`gp-idea-image gp-idea-${i}`} />
              <div className="gp-idea-caption">
                <h3>{name}</h3>
                <p>{description}</p>
                <ArrowRight size={17} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="gp-value" id="why-greenplan">
        <div className="gp-container gp-value-inner">
          <div className="gp-value-copy">
            <h2>Plan It Yourself, Save Money</h2>
            <p>
              Explore your ideas, plan before you buy,
              <br />
              and create a space you'll love.
            </p>
          </div>
          <div className="gp-value-item">
            <PiggyBank />
            <p>
              <strong>Buy With Confidence</strong>
              <span>
                Think through your plants
                <br />
                and materials.
              </span>
            </p>
          </div>
          <div className="gp-value-item">
            <Leaf />
            <p>
              <strong>DIY Friendly</strong>
              <span>
                Start with an idea.
                <br />
                Make it your own.
              </span>
            </p>
          </div>
          <div className="gp-value-item">
            <Heart />
            <p>
              <strong>Your Dream Space</strong>
              <span>
                A yard that fits
                <br />
                your lifestyle.
              </span>
            </p>
          </div>
        </div>
      </section>
      <footer className="gp-footer gp-container">
        <span className="gp-brand">
          <Sprout size={20} />
          GreenPlan
        </span>
        <span>A little planning. A greener possibility.</span>
        <a href="#how-it-works">Back to the beginning ↑</a>
      </footer>
    </div>
  );
}
