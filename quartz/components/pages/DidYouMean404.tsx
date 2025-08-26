import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

// @ts-ignore – Quartz inlines *.inline.ts bundles as text
import didYouMeanScript from "./didyoumean.inline.ts"

const DidYouMean404: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/"

  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>{i18n(cfg.locale).pages.error.notFound}</p>
      <div id="didyoumean" class="didyoumean" data-base={baseDir}></div>
      <a href={baseDir}>{i18n(cfg.locale).pages.error.home}</a>
    </article>
  )
}

DidYouMean404.css = `
  .didyoumean { margin: .75rem 0 .5rem; font-size: .95rem; }
  .didyoumean a { text-decoration: underline; }
  .didyoumean code { padding: .1rem .25rem; background: var(--lightgray); border-radius: 4px; }
`

DidYouMean404.afterDOMLoaded = didYouMeanScript
export default (() => DidYouMean404) satisfies QuartzComponentConstructor
