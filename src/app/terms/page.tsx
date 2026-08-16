import HomeNav from "@/components/HomeNav";
import Link from "next/link";

export const metadata = { title: "Terms of Service — Luck Images" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Legal</p>
          <h1 className="text-4xl font-black tracking-tight uppercase mb-2">Terms of Service</h1>
          <p className="text-xs text-[#444] mb-14">Last updated: August 2026</p>

          <div className="space-y-10 text-sm text-[#888] leading-relaxed">

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">1. Services</h2>
              <p>
                Luck Images LLC ("Luck Images," "we," "us") provides real estate photography, aerial media,
                video, and related services in the Austin, TX area. By booking a shoot or using our client portal,
                you agree to these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">2. Bookings & Payment</h2>
              <p className="mb-3">
                Shoots are confirmed upon receipt of a booking request. No deposit is required — payment
                is due upon delivery of media, at the time of download through the client portal.
              </p>
              <p>
                Cancellations made within 24 hours of a scheduled shoot may be subject to a cancellation fee.
                We reserve the right to reschedule due to weather or other circumstances beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">3. Media Delivery</h2>
              <p className="mb-3">
                Edited photos and videos are delivered digitally via our client portal within the turnaround
                time specified at booking (typically 24 hours for standard packages). Rush delivery may be
                available for an additional fee.
              </p>
              <p>
                Media files are available for download from the portal for a minimum of 90 days from delivery.
                We recommend downloading and backing up all files promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">4. License & Usage</h2>
              <p className="mb-3">
                Upon full payment, Luck Images grants you a non-exclusive, perpetual license to use the
                delivered media for real estate marketing purposes, including MLS listings, social media, and
                print materials.
              </p>
              <p>
                Luck Images retains the copyright to all photographs and videos and may use them in our
                portfolio, website, and marketing unless you request otherwise in writing prior to the shoot.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">5. Client Portal</h2>
              <p className="mb-3">
                Access to the client portal is provided to clients and authorized team members. You are
                responsible for maintaining the confidentiality of your login credentials. Do not share
                your account with unauthorized parties.
              </p>
              <p>
                Team features allow you to invite brokerage teammates to share access to your shoots and
                invoices. All team members are bound by these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">6. Limitation of Liability</h2>
              <p>
                Luck Images is not liable for indirect, incidental, or consequential damages arising from
                the use of our services or media. Our total liability is limited to the amount paid for
                the shoot in question.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">7. Changes to Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of our services after changes
                are posted constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xs tracking-[3px] uppercase text-[#555] mb-3">8. Contact</h2>
              <p>
                Questions? Reach us at{" "}
                <a href="mailto:ryan@luckimages.com" className="text-white underline underline-offset-4 hover:text-[#4ade80] transition-colors">
                  ryan@luckimages.com
                </a>{" "}
                or visit{" "}
                <Link href="/contact" className="text-white underline underline-offset-4 hover:text-[#4ade80] transition-colors">
                  our contact page
                </Link>.
              </p>
            </section>

          </div>

          <div className="mt-14 pt-8 border-t border-white/10 flex gap-6">
            <Link href="/privacy" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">
              Privacy Policy →
            </Link>
            <Link href="/" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">
              ← Home
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-6 text-center mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-white/20">
          © 2026 Luck Images — Austin, TX
        </span>
      </footer>
    </main>
  );
}
