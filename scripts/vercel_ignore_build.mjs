const ref = String(process.env.VERCEL_GIT_COMMIT_REF || "");
const message = String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "");

const isAgentBranch = ref.startsWith("agent/");
const explicitPreview = /\[deploy-preview\]/i.test(message);

if (isAgentBranch && !explicitPreview) {
  console.log(
    `Skipping automatic Vercel preview for ${ref || "unknown ref"}. ` +
      "Add [deploy-preview] to the commit message to request one."
  );
  process.exit(0);
}

console.log(`Continuing Vercel deployment for ${ref || "unknown ref"}.`);
process.exit(1);
