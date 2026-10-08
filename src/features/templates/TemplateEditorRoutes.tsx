import { Route, Routes } from 'react-router-dom'
import { TemplateEditorRoute } from './TemplateEditor'

/** `/settings/templates/*`: editing a saved template, loaded on first visit. */
export function TemplateEditorRoutes() {
  return (
    <Routes>
      <Route path=":templateId/*" element={<TemplateEditorRoute />} />
    </Routes>
  )
}
