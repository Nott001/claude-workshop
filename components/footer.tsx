import type { UserRole } from "@/types";

const imgLogo = "https://www.figma.com/api/mcp/asset/e710e6a4-73be-4bf9-8c93-72c559d307f0";
const imgFacebook = "https://www.figma.com/api/mcp/asset/ed02e5c9-df38-4602-9eb7-087fef7a6de1";
const imgInstagram = "https://www.figma.com/api/mcp/asset/3aaf8d80-06be-4f08-82c2-e91f25c93e37";
const imgTwitter = "https://www.figma.com/api/mcp/asset/56f59f55-c565-4c7d-a2d4-59473ef79d6c";

function AttendeeFooter() {
  return (
    <footer className="flex flex-col gap-12 border-t border-border bg-background px-16 pt-12 pb-12">
      <div className="flex items-start justify-between">
        <div className="flex max-w-[320px] flex-col gap-6">
          <div className="flex items-center gap-3">
            <img src={imgLogo} alt="" className="size-8" />
            <span className="text-xl font-bold text-foreground">StartupLab</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Empowering the next generation of business leaders through AI-driven
            innovation and education.
          </p>
        </div>

        <div className="flex gap-12">
          <div className="flex flex-col gap-4">
            <h5 className="text-base font-bold text-foreground">Company</h5>
            <ul className="flex list-none flex-col gap-2">
              <li className="text-sm text-muted-foreground">About Us</li>
              <li className="text-sm text-muted-foreground">Contact</li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="text-base font-bold text-foreground">Connect</h5>
            <div className="flex gap-4">
              <a href="#" aria-label="Facebook">
                <img src={imgFacebook} alt="" className="size-5" />
              </a>
              <a href="#" aria-label="Instagram">
                <img src={imgInstagram} alt="" className="size-5" />
              </a>
              <a href="#" aria-label="Twitter">
                <img src={imgTwitter} alt="" className="size-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <p className="text-xs text-muted-foreground">
          &copy; 2024 StartupLab Business Center. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function StaffFooter() {
  return (
    <footer className="flex items-center justify-between border-t border-border bg-background px-6 py-6">
      <p className="text-sm font-medium tracking-wider text-muted-foreground">
        &copy; 2024 StartupLab Business Center. All rights reserved.
      </p>
    </footer>
  );
}

export function Footer({ role }: { role: UserRole }) {
  if (role === "attendee") return <AttendeeFooter />;
  return <StaffFooter />;
}
