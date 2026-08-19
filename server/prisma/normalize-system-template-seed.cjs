'use strict';

function normalizeSystemTemplateSteps(templates) {
  for (const template of templates) {
    for (const step of template.steps) {
      if (!String(step.keterangan ?? '').trim()) {
        step.keterangan = step.kegiatan;
      }
    }
  }
  return templates;
}

module.exports = { normalizeSystemTemplateSteps };
