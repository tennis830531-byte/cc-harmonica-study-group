import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

const STORE_NAME = "comment-captchas";
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

declare const Netlify: {
  context?: {
    deploy?: {
      context?: string;
    };
  };
};

function getCaptchaStore() {
  if (Netlify.context?.deploy.context === "production") {
    return getStore(STORE_NAME, { consistency: "strong" });
  }

  return getDeployStore(STORE_NAME);
}

function createCode() {
  const values = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(values, (value) => CAPTCHA_CHARS[value % CAPTCHA_CHARS.length]).join("");
}

export default async (_request: Request, _context: Context) => {
  const code = createCode();
  const token = crypto.randomUUID();
  const store = getCaptchaStore();

  await store.setJSON(token, {
    code,
    createdAt: Date.now(),
  });

  return Response.json({ token, code });
};

export const config: Config = {
  path: "/api/captcha",
};
