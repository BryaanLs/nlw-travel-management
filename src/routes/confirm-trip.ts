import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";

export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/trips/:tripId/confirm",
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid(),
        }),
      },
    },
    async (req, reply) => {
      const { tripId } = req.params;
      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId,
        },
        include: {
          participants: {
            where: {
              is_owner: false,
            },
          },
        },
      });

      if (!trip) {
        throw new Error("Not found trip");
      }
      if (trip.is_confirmed) {
        return reply.redirect(`http://localhost:3333/trips/${tripId} `);
      }

      await prisma.trip.update({
        where: { id: tripId },
        data: {
          is_confirmed: true,
        },
      });

      const formattedStartDate = dayjs(trip.starts_at).format("LL");
      const formattedEndDate = dayjs(trip.ends_at).format("LL");
      const mail = await getMailClient();

      await Promise.all([
        trip.participants.map(async (participants) => {
          const confirmationLink = `http://localhost:3333/participants/${participants.id}/confirm`;
          const message = await mail.sendMail({
            from: {
              name: "Equipe plann.er",
              address: "oi@plann.er",
            },
            to: participants.email,
            subject: `Confirme sua viagem para ${trip.destination}`,
            html: `<div
  style="
    font-family: Arial, Helvetica, sans-serif;
    width: 500px;
    height: auto;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.28);
    border-radius: 15px;
    flex-direction: column;
    background-color: white;
    padding: 10px 30px;
  "
>
  <h3 style="text-align: start; width: 100%">
    Você foi convidado para uma viagem em
    <strong>${trip.destination}</strong>
  </h3>
  <p style="width: 100%">
    Na seguintes data: <br />Data de embarque <b>${formattedStartDate})}</b
    ><br />Data de retorno <b>${formattedEndDate}</b>
  </p>
  <p style="text-align: center; width: 100%">
    Clique no botão abaixo para confirmar a viagem
  </p>
  <div
    style="
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-around;
    "
  >
    <a
      href="${confirmationLink}"
      style="
        padding: 10px 20px;
        width: 70%;
        text-align: center;
        background-color: rgb(0, 132, 255);
        text-decoration: none;
        color: white;
        border-radius: 5px;
      "
      >Confirmar viagem</a
    >
  </div>
  <p style="font-size: 12px; text-align: center">
    Caso não saiba do que se trata, pedimos desculpas pela confusão e que apenas
    ignore esse email.
  </p>
</div>

`.trim(),
          });
          console.log(nodemailer.getTestMessageUrl(message));
        }),
      ]);

      return reply.redirect("https://localhost:3333/trips");
    }
  );
}
