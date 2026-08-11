const { PDFDocument } = require('pdf-lib');
async function run() {
  const doc = await PDFDocument.create();
  // PDFDocument.create doesn't have pages by default? Let's add one and remove it?
  doc.addPage();
  doc.removePage(0);
  const bytes = await doc.save();
  const doc2 = await PDFDocument.load(bytes);
  console.log("Pages:", doc2.getPages().length);
}
run();
