/**
 * @particle-academy/fancy-template-ui: a visual builder for paged document
 * templates. `<TemplateBuilder>` and its parts; the React-free model lives at
 * `@particle-academy/fancy-template-ui/core` and is re-exported here.
 */
export { TemplateBuilder, type TemplateActivity, type TemplateBuilderProps } from "./TemplateBuilder";
export { BlockList, type BlockListProps, BUILTIN_LABELS, defaultsFor, movedId } from "./BlockList";
export { BlockSettings, type BlockSettingsProps, type KindSettingsProps } from "./BlockSettings";
export { PageSettings, type PageSettingsProps } from "./PageSettings";
export { FieldPicker, RichTextField, type FieldPickerProps, type RichTextFieldProps } from "./RichTextField";
export { TemplatePreview, type PreviewMode, type TemplatePreviewProps } from "./TemplatePreview";
export { PendingChanges, type PendingChangesProps } from "./PendingChanges";
export { BuilderContext, useBuilder, type BuilderContextValue, type FieldOption } from "./context";
export { sampleData, PLACEHOLDER_PNG } from "./samples";
export { bandToHtml, htmlToBand, htmlToParas, htmlToRuns, parasToHtml, runsToHtml, PAGE_TOKEN, PAGES_TOKEN } from "./runs-html";
export * from "./core";
