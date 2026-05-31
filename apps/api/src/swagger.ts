import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Pulse API",
      version: "0.1.0",
      description:
        "EB-1A petition risk analysis, USCIS case tracking, and OpenAlex citation verification.",
    },
    servers: [
      {
        url: "{protocol}://{host}:{port}",
        variables: {
          protocol: { default: "http", enum: ["http", "https"] },
          host: { default: "localhost" },
          port: { default: "4000" },
        },
      },
    ],
    tags: [
      { name: "Health", description: "Readiness / liveness probes" },
      { name: "Cases", description: "Immigration cases" },
      { name: "Petitions", description: "Petition uploads & analysis" },
      { name: "Analyses", description: "RFE risk analysis results" },
      { name: "Receipts", description: "USCIS receipt tracking" },
      { name: "Settings", description: "LLM, USCIS, and OpenAlex configuration" },
      { name: "Uploads", description: "Presigned upload URLs" },
    ],
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
