DROP INDEX IF EXISTS `idx_md_artifacts_integration`;
CREATE INDEX `idx_md_artifacts_integration_date` ON `mdArtifacts` (`integration`,`artifactDate`);