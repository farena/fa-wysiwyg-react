import FaWysiwyg from "./components/FaWysiwyg";
import "./assets/fa-wysiwyg.scss";

export { FaWysiwyg };
export default FaWysiwyg;
export type { FaWysiwygProps, FaWysiwygHandle } from "./components/FaWysiwyg";

/**
 * The i18n surface. `registerLang` adds or extends a dictionary, `getLang`
 * hands back a copy of one to build on, and `LANGS` lists every code the `lang`
 * prop accepts at that moment.
 */
export { registerLang, getLang, LANGS, DEFAULT_LANG } from "./core/lang";
