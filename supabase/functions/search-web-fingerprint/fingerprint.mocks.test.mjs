import assert from "node:assert/strict";
import { detectProvider } from "./index.ts";

const cases = [
  {
    name: "IONOS y 1&1",
    url: "https://empresa.1and1.com",
    html: `<footer>Website by IONOS - powered by 1&1</footer><script src="https://assets.ionos.com/main.js"></script>`,
    expected: "IONOS",
  },
  {
    name: "BeeDIGITAL",
    url: "https://negocioejemplo.es",
    html: `<meta name="generator" content="BeeDigital Suite"><script src="https://cdn.beedigital.es/site/app.js"></script><footer>Diseñada por BeeDIGITAL</footer>`,
    expected: "BeeDIGITAL",
  },
  {
    name: "GoDaddy Website Builder",
    url: "https://my-business.godaddysites.com",
    html: `<script src="https://img1.wsimg.com/blobby/go/gd.js"></script>`,
    expected: "GoDaddy Website Builder",
  },
  {
    name: "Hostinger",
    url: "https://restaurante.hostingersite.com",
    html: `<meta name="generator" content="Hostinger Website Builder"><script src="https://static.hostinger.com/hpanel/runtime.js"></script>`,
    expected: "Hostinger",
  },
  {
    name: "Webflow",
    url: "https://marca.webflow.io",
    html: `<html class="w-mod-js w-mod-ix"><link href="https://assets.website-files.com/site.css" rel="stylesheet" /><script src="https://cdn.prod.website-files.com/webflow.js"></script><footer>Made in Webflow</footer>`,
    expected: "Webflow",
  },
];

for (const testCase of cases) {
  const result = detectProvider(testCase.html, testCase.url);
  assert.ok(result, `Sin resultado para: ${testCase.name}`);
  assert.equal(result.provider, testCase.expected, `Proveedor incorrecto para: ${testCase.name}`);
}

console.log(`OK: ${cases.length} mocks de fingerprint validados.`);
