import cors from "cors";

const configureCors = () => {
  return cors({
    origin: (requestOrigin: string | undefined, callbak: any) => {
      const allowedrequestOrigins = [
        "http://localhost:3000", // local dev
      ];

      if (!requestOrigin || allowedrequestOrigins.indexOf(requestOrigin) !== -1)
        callbak(null, true);
      else callbak(new Error("Not allowed by CORS"));
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],

    allowedHeaders: ["Content-Type", "Authorization", "Accept-Version"],

    exposedHeaders: ["Content-Range", "X-Content-Range"],

    credentials: true,

    preflightContinue: false,

    maxAge: 600,

    optionsSuccessStatus: 204,
  });
};


export default configureCors;