-- Valid header edits log internal field keys up to 22 characters
-- (`dasarHukumPeraturanIds`, `kualifikasiPelaksanaan`).
ALTER TABLE `LogEditSopDomainField`
  MODIFY `domainField` VARCHAR(22) NOT NULL;
