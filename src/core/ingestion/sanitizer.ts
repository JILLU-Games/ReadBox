import * as csstree from "css-tree";
import sanitizeHtml from "sanitize-html";

export const SAFE_HTML_TAGS: readonly string[] = [
  "p",
  "br",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "small",
  "sub",
  "sup",
  "del",
  "ins",
  "mark",
  "center",
  "font",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "caption",
  "colgroup",
  "col",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "button",
  "img",
  "figure",
  "figcaption",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "nav",
  "aside",
  "details",
  "summary",
  "abbr",
  "kbd",
  "samp",
  "var",
  "style",
];

export const DROP_CONTENT_TAGS: string[] = [
  "script",
  "noscript",
  "template",
  "title",
  "svg",
  "math",
  "iframe",
  "object",
  "embed",
  "textarea",
  "option",
];

export const SAFE_DATA_IMAGE_PREFIXES: readonly string[] = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/gif;base64,",
  "data:image/webp;base64,",
];

export const CSS_BLOCK_MAX_INPUT_BYTES = 128 * 1024;
export const CSS_TOTAL_MAX_RETAINED_BYTES = 256 * 1024;
export const CSS_MAX_RETAINED_RULES = 512;
export const CSS_MAX_NESTING_DEPTH = 8;

export const CSS_ALLOWED_PROPERTIES = new Set([
  "align-items",
  "align-self",
  "aspect-ratio",
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-style",
  "border-bottom-width",
  "border-collapse",
  "border-color",
  "border-left",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-radius",
  "border-right",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-spacing",
  "border-style",
  "border-top",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-style",
  "border-top-width",
  "border-width",
  "box-shadow",
  "box-sizing",
  "clear",
  "color",
  "column-gap",
  "cursor",
  "display",
  "empty-cells",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "float",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "gap",
  "grid",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "justify-content",
  "letter-spacing",
  "line-height",
  "list-style-position",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "opacity",
  "outline",
  "overflow",
  "overflow-wrap",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "row-gap",
  "table-layout",
  "text-align",
  "text-decoration",
  "text-indent",
  "text-overflow",
  "text-transform",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
  "word-spacing",
  "word-wrap",
]);

export const CSS_ALLOWED_FUNCTIONS = new Set([
  "calc",
  "clamp",
  "hsl",
  "hsla",
  "linear-gradient",
  "max",
  "min",
  "radial-gradient",
  "rgb",
  "rgba",
]);

export const CSS_ALLOWED_MEDIA_TYPES = new Set(["all", "screen"]);
export const CSS_ALLOWED_MEDIA_FEATURES = new Set([
  "max-width",
  "min-width",
  "orientation",
  "width",
]);
export const CSS_ALLOWED_ORIENTATIONS = new Set(["landscape", "portrait"]);
export const CSS_ALLOWED_LENGTH_UNITS = new Set([
  "ch",
  "cm",
  "em",
  "ex",
  "in",
  "mm",
  "pc",
  "pt",
  "px",
  "q",
  "rem",
  "vh",
  "vmax",
  "vmin",
  "vw",
]);

const CSS_FORBIDDEN_SUBSTRINGS = [
  "javascript:",
  "vbscript:",
  "expression(",
  "url(",
  "var(",
  "env(",
  "attr(",
  "</style",
];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]+/g;

export class CssBudget {
  retainedBytes = 0;
  retainedRules = 0;

  reserve(fragment: string, rules = 0): boolean {
    const bytes = Buffer.byteLength(fragment, "utf8");
    if (this.retainedBytes + bytes > CSS_TOTAL_MAX_RETAINED_BYTES) {
      return false;
    }
    if (this.retainedRules + rules > CSS_MAX_RETAINED_RULES) {
      return false;
    }
    this.retainedBytes += bytes;
    this.retainedRules += rules;
    return true;
  }
}

function cssInputWithinLimit(value: string): boolean {
  return Buffer.byteLength(value, "utf8") <= CSS_BLOCK_MAX_INPUT_BYTES;
}

function hasForbiddenCssText(serialized: string): boolean {
  const normalized = serialized.replace(/\\/g, "").toLowerCase();
  return CSS_FORBIDDEN_SUBSTRINGS.some((token) => normalized.includes(token));
}

function declarationValueDepth(node: csstree.CssNode): number {
  let maxDepth = 0;
  function visit(current: csstree.CssNode, depth: number) {
    if (depth > maxDepth) maxDepth = depth;
    if (depth > CSS_MAX_NESTING_DEPTH) return;
    if (current.type === "Value") {
      current.children.forEach((child) => visit(child, depth));
    } else if (
      current.type === "Function" ||
      current.type === "Parentheses" ||
      current.type === "Brackets" ||
      current.type === "Block"
    ) {
      current.children.forEach((child) => visit(child, depth + 1));
    }
  }
  visit(node, 0);
  return maxDepth;
}

function isSafeDeclarationValue(node: csstree.CssNode): boolean {
  if (node.type === "Raw") {
    return false;
  }
  if (declarationValueDepth(node) > CSS_MAX_NESTING_DEPTH) {
    return false;
  }

  let safe = true;
  csstree.walk(node, {
    enter(child: csstree.CssNode) {
      if (!safe) return;
      if (child.type === "Url" || child.type === "Atrule" || child.type === "Raw") {
        safe = false;
        return;
      }
      if (child.type === "Function") {
        if (!CSS_ALLOWED_FUNCTIONS.has(child.name.toLowerCase())) {
          safe = false;
          return;
        }
      }
    },
  });
  if (!safe) return false;

  const serialized = csstree.generate(node).trim();
  if (!serialized || hasForbiddenCssText(serialized)) {
    return false;
  }
  return true;
}

function sanitizeDeclarationNodes(nodes: csstree.CssNode[]): string {
  const safeParts: string[] = [];
  for (const node of nodes) {
    if (node.type !== "Declaration") continue;
    const property = node.property.toLowerCase();
    if (!property || property.startsWith("--")) continue;
    if (!CSS_ALLOWED_PROPERTIES.has(property)) continue;
    if (!isSafeDeclarationValue(node.value)) continue;

    const valueText = csstree.generate(node.value).trim();
    if (!valueText) continue;

    let declaration = `${property}:${valueText}`;
    if (node.important) {
      declaration += " !important";
    }
    safeParts.push(`${declaration};`);
  }
  return safeParts.join("");
}

function isSafeMediaFeature(feature: csstree.CssNode): boolean {
  if (feature.type !== "Feature" || feature.kind !== "media") {
    return false;
  }
  const featureName = feature.name.toLowerCase();
  if (!CSS_ALLOWED_MEDIA_FEATURES.has(featureName)) {
    return false;
  }
  if (!feature.value) {
    return false;
  }

  if (featureName === "orientation") {
    return (
      feature.value.type === "Identifier" &&
      CSS_ALLOWED_ORIENTATIONS.has(feature.value.name.toLowerCase())
    );
  }

  if (feature.value.type === "Number") {
    return Number(feature.value.value) === 0;
  }
  if (feature.value.type === "Dimension") {
    const numeric = Number(feature.value.value);
    if (!Number.isFinite(numeric) || numeric < 0) return false;
    return CSS_ALLOWED_LENGTH_UNITS.has(feature.value.unit.toLowerCase());
  }
  return false;
}

function isSafeMediaCondition(condition: csstree.Condition): boolean {
  if (condition.children.isEmpty) return false;
  const children = condition.children.toArray();
  let expectTerm = true;
  let sawTerm = false;

  for (const child of children) {
    if (expectTerm) {
      if (isSafeMediaFeature(child)) {
        sawTerm = true;
        expectTerm = false;
        continue;
      }
      return false;
    }
    if (
      child.type === "Identifier" &&
      child.name.toLowerCase() === "and"
    ) {
      expectTerm = true;
      continue;
    }
    return false;
  }

  return sawTerm && !expectTerm;
}

function isSafeMediaPrelude(prelude: csstree.CssNode | null): boolean {
  if (!prelude || prelude.type !== "AtrulePrelude") {
    return false;
  }
  const listNode = prelude.children.first;
  if (
    !listNode ||
    listNode.type !== "MediaQueryList" ||
    prelude.children.size !== 1
  ) {
    return false;
  }
  if (listNode.children.size !== 1) {
    return false;
  }
  const query = listNode.children.first;
  if (!query || query.type !== "MediaQuery") {
    return false;
  }
  if (query.modifier) {
    return false;
  }

  let hasSomething = false;
  if (query.mediaType) {
    if (!CSS_ALLOWED_MEDIA_TYPES.has(query.mediaType.toLowerCase())) {
      return false;
    }
    hasSomething = true;
  }
  if (query.condition) {
    if (!isSafeMediaCondition(query.condition)) {
      return false;
    }
    hasSomething = true;
  }
  return hasSomething;
}

function sanitizeStylesheetNode(
  node: csstree.CssNode,
  depth = 0,
): { readonly css: string; readonly rules: number } | null {
  if (node.type === "Rule") {
    if (node.prelude.type === "Raw") return null;
    const selector = csstree.generate(node.prelude).trim();
    if (!selector || selector.toLowerCase().includes("</style")) {
      return null;
    }
    const sanitized = sanitizeDeclarationNodes(node.block.children.toArray());
    if (!sanitized) return null;
    return { css: `${selector}{${sanitized}}`, rules: 1 };
  }

  if (node.type === "Atrule" && node.name.toLowerCase() === "media") {
    if (depth >= CSS_MAX_NESTING_DEPTH) return null;
    if (!node.block || !isSafeMediaPrelude(node.prelude)) {
      return null;
    }
    const nestedFragments: string[] = [];
    let nestedCount = 0;
    for (const child of node.block.children.toArray()) {
      const sanitizedChild = sanitizeStylesheetNode(child, depth + 1);
      if (!sanitizedChild) continue;
      nestedFragments.push(sanitizedChild.css);
      nestedCount += sanitizedChild.rules;
    }
    if (nestedFragments.length === 0) return null;
    const mediaText = node.prelude
      ? csstree.generate(node.prelude).trim()
      : "";
    if (!mediaText || mediaText.toLowerCase().includes("</style")) return null;
    return {
      css: `@media ${mediaText}{${nestedFragments.join("")}}`,
      rules: nestedCount + 1,
    };
  }

  return null;
}

export function sanitizeInlineCss(
  style: string,
  budget: CssBudget = new CssBudget(),
): string {
  if (!style || !cssInputWithinLimit(style)) return "";
  try {
    const ast = csstree.parse(style, {
      context: "declarationList",
      parseValue: true,
    });
    if (ast.type !== "DeclarationList") return "";
    const sanitized = sanitizeDeclarationNodes(ast.children.toArray());
    if (!sanitized || !budget.reserve(sanitized, 0)) {
      return "";
    }
    return sanitized;
  } catch {
    return "";
  }
}

export function sanitizeStylesheet(
  stylesheet: string,
  budget: CssBudget = new CssBudget(),
): string {
  if (!stylesheet || !cssInputWithinLimit(stylesheet)) return "";
  try {
    const ast = csstree.parse(stylesheet, {
      context: "stylesheet",
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: true,
    });
    if (ast.type !== "StyleSheet") return "";
    const fragments: string[] = [];
    for (const child of ast.children.toArray()) {
      const sanitized = sanitizeStylesheetNode(child, 0);
      if (!sanitized) continue;
      if (!budget.reserve(sanitized.css, sanitized.rules)) {
        break;
      }
      fragments.push(sanitized.css);
    }
    return fragments.join("");
  } catch {
    return "";
  }
}

const SAFE_ATTACHMENT_IMAGE_PATH_RE =
  /^\/api\/messages\/attachment\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\?inline=1)?$/i;

export function isSafeRasterDataImageUri(src: string | undefined): boolean {
  if (!src) return false;
  const lowered = src.trim().toLowerCase();
  return SAFE_DATA_IMAGE_PREFIXES.some((prefix) => lowered.startsWith(prefix));
}

export function isSafeInternalAttachmentImagePath(
  src: string | undefined,
): boolean {
  if (!src) return false;
  return SAFE_ATTACHMENT_IMAGE_PATH_RE.test(src.trim());
}

export function isSafeEmailImageSource(src: string | undefined): boolean {
  return (
    isSafeRasterDataImageUri(src) || isSafeInternalAttachmentImagePath(src)
  );
}

export interface SanitizeHtmlEmailOptions {
  readonly cidMap?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
}

function resolveCidReferencesInHtml(
  html: string,
  cidMap?: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
): string {
  if (!html || !cidMap) return html;
  const lookup = (key: string): string | undefined => {
    if (cidMap instanceof Map) {
      return (
        cidMap.get(key) ??
        cidMap.get(key.toLowerCase()) ??
        undefined
      );
    }
    const record = cidMap as Readonly<Record<string, string>>;
    return record[key] ?? record[key.toLowerCase()];
  };

  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])cid:([^"']+)(["'])/gi,
    (fullMatch, prefix: string, rawCid: string, suffix: string) => {
      const cleanedCid = rawCid.replace(/^<|>$/g, "").trim();
      if (!cleanedCid) return fullMatch;
      const mapped = lookup(cleanedCid);
      return mapped ? `${prefix}${mapped}${suffix}` : fullMatch;
    },
  );
}

export function isSafeAnchorHref(href: string | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  // Block protocol-relative URLs or embedded control chars
  const cleaned = trimmed.replace(CONTROL_CHARS_RE, "");
  if (cleaned.startsWith("//")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      return ["http:", "https:", "mailto:"].includes(
        parsed.protocol.toLowerCase(),
      );
    } catch {
      return false;
    }
  }
  return true;
}

export function sanitizeHtmlEmail(
  rawHtml: string,
  options?: SanitizeHtmlEmailOptions,
): string {
  if (!rawHtml || !rawHtml.trim()) return "";

  const resolvedHtml = resolveCidReferencesInHtml(rawHtml, options?.cidMap);
  const budget = new CssBudget();
  const sanitizedStylesheets: string[] = [];

  const passOne = sanitizeHtml(resolvedHtml, {
    allowedTags: [...SAFE_HTML_TAGS],
    allowedAttributes: {
      a: ["href", "title", "rel", "target", "name"],
      button: ["type", "title", "disabled"],
      img: ["src", "alt", "title", "width", "height", "align", "border"],
      table: [
        "width",
        "height",
        "align",
        "valign",
        "bgcolor",
        "border",
        "cellpadding",
        "cellspacing",
        "role",
        "dir",
      ],
      thead: ["align", "valign", "bgcolor"],
      tbody: ["align", "valign", "bgcolor"],
      tfoot: ["align", "valign", "bgcolor"],
      tr: ["align", "valign", "bgcolor"],
      td: [
        "width",
        "height",
        "align",
        "valign",
        "bgcolor",
        "colspan",
        "rowspan",
        "nowrap",
      ],
      th: [
        "width",
        "height",
        "align",
        "valign",
        "bgcolor",
        "colspan",
        "rowspan",
        "nowrap",
      ],
      font: ["color", "face", "size"],
      "*": ["class", "style", "align", "dir", "lang", "title", "role", "aria-label"],
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["data"],
    },
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    parseStyleAttributes: false,
    disallowedTagsMode: "discard",
    nonTextTags: DROP_CONTENT_TAGS,
    transformTags: {
      "*": (tagName, attribs) => {
        const nextAttribs: Record<string, string> = {};
        for (const [key, val] of Object.entries(attribs)) {
          const loweredKey = key.toLowerCase();
          if (loweredKey.startsWith("on") || typeof val !== "string") continue;
          if (loweredKey === "style") {
            const safeStyle = sanitizeInlineCss(val, budget);
            if (safeStyle) {
              nextAttribs.style = safeStyle;
            }
          } else {
            nextAttribs[key] = val;
          }
        }
        return { tagName, attribs: nextAttribs };
      },
      a: (tagName, attribs) => {
        const nextAttribs = { ...attribs };
        if (!isSafeAnchorHref(nextAttribs.href)) {
          delete nextAttribs.href;
        }
        nextAttribs.rel = "nofollow noopener noreferrer";
        nextAttribs.target = "_blank";
        return { tagName, attribs: nextAttribs };
      },
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") {
        return !isSafeEmailImageSource(frame.attribs.src);
      }
      if (frame.tag === "style") {
        const cleanedCss = sanitizeStylesheet(frame.text, budget);
        if (!cleanedCss) {
          return true;
        }
        sanitizedStylesheets.push(cleanedCss);
        return false;
      }
      return false;
    },
  });

  if (sanitizedStylesheets.length === 0) {
    return passOne.trim();
  }

  let idx = 0;
  return passOne
    .replace(/<style>[\s\S]*?<\/style>/g, () => {
      const replacement = sanitizedStylesheets[idx];
      idx += 1;
      return replacement ? `<style>${replacement}</style>` : "";
    })
    .trim();
}

export function safeAttachmentFilename(
  value: string | null | undefined,
): string {
  const raw = (value ?? "").replace(CONTROL_CHARS_RE, "").replace(/\\/g, "/");
  let name = raw.split("/").pop() ?? "";
  name = name.normalize("NFC").trim().replace(/^\.+|\.+$/g, "");
  name = Array.from(name)
    .map((ch) =>
      /^[a-zA-Z0-9.()_\- +@]$/.test(ch) || /^[\p{L}\p{N}\p{M}]$/u.test(ch)
        ? ch
        : "_",
    )
    .join("")
    .trim()
    .replace(/^\.+|\.+$/g, "");
  if (!name) {
    name = "attachment.bin";
  }
  return name.slice(0, 180);
}
