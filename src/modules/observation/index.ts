/**
 * Módulo Observation — expõe capabilities do Observation Engine v1 (ADR-012).
 * Side-effect: importa `./capabilities` para registrá-las no registry global.
 */
import "./capabilities";

export * from "./ai";
