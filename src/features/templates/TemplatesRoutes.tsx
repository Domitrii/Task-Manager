import { Route, Routes } from 'react-router-dom'
import { TemplateEditorRoute } from './TemplateEditor'
import { TemplatesPage } from './TemplatesPage'

/** Everything under `/templates`, loaded together on first visit. */
export function TemplatesRoutes() {
  return (
    <Routes>
      <Route index element={<TemplatesPage />} />
      <Route path=":templateId/*" element={<TemplateEditorRoute />} />
    </Routes>
  )
}
