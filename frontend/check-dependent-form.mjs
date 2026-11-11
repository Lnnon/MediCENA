import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Fields, PatientMembershipProvider: Provider, DependentInformationFields: Dependent } = await server.ssrLoadModule('/src/components/users/shared/PatientMembershipFields.jsx')
  for (const status of [undefined, 'None', 'Member', 'Dependent', 'dependent', ' MEMBER ']) {
    const html = renderToStaticMarkup(React.createElement(Provider, { patient: { philHealthStatus: status } },
      React.createElement('form', null, React.createElement(Fields), React.createElement('input', { name: 'lastExistingField' }), React.createElement(Dependent), React.createElement('button', null, 'Save'))))
    const visible = String(status).toLowerCase() === 'dependent'
    assert.equal(html.includes('<fieldset'), visible, `Visibility for ${status}`)
    assert.equal(html.includes('name="dependent_last_name"'), visible)
    if (visible) {
      assert.ok(html.indexOf('lastExistingField') < html.indexOf('<fieldset'))
      assert.ok(html.indexOf('</fieldset>') < html.indexOf('<button'))
      const keys = ['last_name', 'first_name', 'suffix', 'middle_name', 'date_of_birth', 'sex']
      const positions = keys.map((key) => html.indexOf(`name="dependent_${key}"`))
      assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])))
    }
  }
  for (const path of ['src/components/users/bhc/BHCPatientList.jsx', 'src/components/users/cho/CHOPatientList.jsx']) {
    const text = readFileSync(path, 'utf8')
    const sections = text.match(/<PatientMembershipProvider[\s\S]*?<\/PatientMembershipProvider>/g)
    assert.equal(sections.length, path.includes('/bhc/') ? 2 : 1)
    for (const section of sections) assert.ok(section.indexOf('<DependentInformationFields />') < section.indexOf('<div className="patient-form-actions">'))
  }
  console.log('Passed: all membership options, default absence, normalization, field order, and bottom placement in all three forms.')
} finally { await server.close() }
