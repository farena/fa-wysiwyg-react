import { createContext, useContext } from "react";
import { defaultTranslator, type Translator } from "../core/lang";

/**
 * The lookup handed down to the toolbar, the panels and the balloons. React
 * context reaches through createPortal, so the labels rendered into <body>
 * follow the editor's `lang` too.
 */
export const TranslatorContext = createContext<Translator>(defaultTranslator);

export const useTranslator = () => useContext(TranslatorContext);
