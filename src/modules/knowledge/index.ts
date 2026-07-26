/**
 * Módulo Knowledge — expõe capabilities do Knowledge Engine v1 (ADR-015).
 * Side-effect: importa `./capabilities` para registrá-las no registry global.
 */
import "./capabilities";

export * from "./ai";
