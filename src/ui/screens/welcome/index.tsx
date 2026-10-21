import { Link } from "react-router";
import { Icon, Logo } from "../../components";
import one from "../../assets/welcome-1.webp";
import two from "../../assets/welcome-2.webp";
import three from "../../assets/welcome-3.webp";

export function WelcomeScreen() {
  return (
    <div className="wl">
      <section className="wl-left">
        <div className="wl-brand">
          <Logo />
          <span className="brand-stack">
            <span className="brand-word">AAINA</span>
            <span className="brand-sub">Desktop</span>
          </span>
        </div>
        <div className="wl-copy">
          <span className="t-eyebrow">Welcome</span>
          <h1 className="t-display">
            Model photos of your products, made <em className="italic">here</em>.
          </h1>
          <p className="muted" style={{ maxWidth: "44ch" }}>
            Add a product photo, pick a model, poses and a scene, and get photos ready for your store. Everything is made and kept on your
            computer. Free and open source.
          </p>
          <div className="actions">
            <Link className="btn btn-primary btn-lg" to="/connect">
              Get started
              <Icon name="right" size="sm" />
            </Link>
            <span className="local-note">
              <Icon name="github" />
              Open source · No account needed
            </span>
          </div>
        </div>
      </section>
      <section className="wl-right" aria-hidden="true">
        <div className="collage">
          <figure className="tall">
            <img src={one} alt="" />
          </figure>
          <figure>
            <img src={two} alt="" />
          </figure>
          <figure>
            <img src={three} alt="" />
          </figure>
        </div>
      </section>
    </div>
  );
}
