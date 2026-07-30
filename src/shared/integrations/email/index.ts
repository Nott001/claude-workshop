import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./providers/console";

let instance: EmailProvider = new ConsoleEmailProvider();

export function configureEmailService(provider: EmailProvider): void {
  instance = provider;
}

export function getEmailService(): EmailProvider {
  return instance;
}
