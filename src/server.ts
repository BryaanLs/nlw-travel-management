import cors from "@fastify/cors";
import fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { confirmParticipants } from "./routes/confirm-participants";
import { confirmTrip } from "./routes/confirm-trip";
import { createTrip } from "./routes/create-trip";

const app = fastify();
app.register(cors, {
  origin: "http://localhost:3333",
});
app.register(createTrip);
app.register(confirmTrip);
app.register(confirmParticipants);
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.listen({ port: 3333 }).then(() => {
  console.log(`Running at 3333`);
});
