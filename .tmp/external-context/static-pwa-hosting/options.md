---
source: Official documentation (live web fetch)
library: Static hosting platforms
package: static-pwa-hosting
topic: free Vite React PWA hosting options
fetched: 2026-11-18T00:00:00Z
official_docs: https://vite.dev/guide/static-deploy.html
---

# Free hosting options for a Vite/React static PWA

## Recommendation

**Choose Cloudflare Pages** for the default recommendation: it explicitly supports Vite Git deployments, gives free/unlimited static-asset requests, supports custom domains, and provides HTTPS. Choose **GitHub Pages** when keeping hosting tightly coupled to an open-source GitHub repository is the priority. Choose **Netlify** for the simplest static-site workflow and generous deployment conveniences. Choose **Vercel** if its Git/preview workflow is already preferred; it is also suitable for static assets, but its Hobby plan has usage caps and personal/non-commercial eligibility considerations that should be checked before relying on it.

## Comparison

| Host | Free/open-source fit | HTTPS | Custom domains | Service workers |
|---|---|---|---|---|
| **GitHub Pages** | Static files; GitHub Free requires a public repository. GitHub Actions runners are free for public repositories. Soft limits: 1 GB published site, 100 GB/month bandwidth, 10 builds/hour (Actions workflow exempt from the build-rate limit). | Yes; all Pages sites, including correctly configured custom domains, support HTTPS and HTTPS enforcement. | Yes; own domain supported. | **Yes**, when served over HTTPS. Project sites need correct Vite `base` (`/<REPO>/`) and the worker must be registered within the site path/scope.
| **Cloudflare Pages** | Free plan: 500 builds/month, 1 concurrent build, 20,000 files/site, 25 MiB/file. Static-asset requests are free and unlimited; Functions use Workers quotas. | Yes; Pages custom hostnames are managed by Pages; Cloudflare also offers free Universal SSL for active Cloudflare zones. | Yes; up to 100/project on Free. Apex domains require Cloudflare nameservers; subdomains can use CNAME. | **Yes**, under HTTPS. Ensure the worker file is deployed at the intended path and its scope matches the app.
| **Netlify** | Current Free plan is $0 forever and lists deploy from Git/API, unlimited deploy previews, custom domains with SSL, and global CDN. Current pricing is credit-based (300-credit limit shown on pricing page), so monitor usage. | Yes; free HTTPS and automatic certificate creation/renewal, including custom domains via Let’s Encrypt. | Yes; bring your own domain. | **Yes**, under HTTPS.
| **Vercel** | Hobby is $0/month and supports Git/CLI/static deployments. Current Hobby limits include 1M CDN requests/month and 100 GB/month fast data transfer; free use is subject to Vercel’s plan terms. | Yes; Hobby includes HTTPS certificates and TLS/SSL encryption. | Yes; custom domains are supported; Hobby limit is 50/project. | **Yes**, under HTTPS.

## PWA/service-worker caveats

Service workers are controlled by browser security rules, not a special host feature: they are available only in a secure context (HTTPS; `http://localhost` is allowed for development). Therefore all four hosts support service workers on their HTTPS URLs. A static host does not automatically make an app a PWA: deploy the worker and manifest as build assets, register the worker with the correct path, and account for GitHub Pages project-site subpaths. SPA history fallback is a separate concern from service-worker support.

## Vite deployment notes

Vite builds to `dist` by default. Its deployment guide documents GitHub Pages, Netlify, Vercel, and Cloudflare Pages. For GitHub project sites, set `base: '/<REPO>/'`; for a user site or custom domain, use `/`.

## Sources

- Vite static deployment: https://vite.dev/guide/static-deploy.html
- GitHub Pages overview: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- GitHub Pages creation/free-repository requirement: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- GitHub Pages HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- GitHub Pages custom domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Cloudflare Pages limits/pricing: https://developers.cloudflare.com/pages/platform/limits/ and https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Universal SSL: https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/
- Netlify pricing: https://www.netlify.com/pricing/
- Netlify custom domains: https://docs.netlify.com/manage/domains/get-started-with-domains/
- Netlify HTTPS: https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/
- Vercel pricing: https://vercel.com/pricing
- Vercel deployments: https://vercel.com/docs/deployments
- Vercel custom domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Service Worker API/security: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
