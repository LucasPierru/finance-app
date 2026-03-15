declare global {
  namespace App {
    interface Locals {
      auth: {
        authenticated: boolean;
        accessToken: string | null;
        user: import("$lib/types/auth").AuthUser | null;
      };
    }
  }

  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: unknown) => void;
        onExit?: (error: unknown, metadata: unknown) => void;
      }) => {
        open: () => void;
        destroy?: () => void;
      };
    };
  }
}

export { };
