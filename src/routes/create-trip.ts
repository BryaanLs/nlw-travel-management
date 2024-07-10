import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";

export async function createTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/trips",
    {
      schema: {
        body: z.object({
          destination: z.string().min(4),
          starts_at: z.coerce.date(),
          ends_at: z.coerce.date(),
          owner_name: z.string(),
          owner_email: z.string().email(),
          emails_to_invite: z.array(z.string().email()),
        }),
      },
    },
    async (req, res) => {
      const {
        destination,
        starts_at,
        ends_at,
        owner_name,
        owner_email,
        emails_to_invite,
      } = req.body;
      if (dayjs(starts_at).isBefore(new Date())) {
        throw new Error("Invalid start date");
      }
      if (
        dayjs(ends_at).isBefore(new Date()) ||
        dayjs(ends_at).isBefore(starts_at)
      ) {
        throw new Error("Invalid end date");
      }

      const trip = await prisma.trip.create({
        data: {
          destination,
          starts_at,
          ends_at,
          participants: {
            createMany: {
              data: [
                {
                  name: owner_name,
                  email: owner_email,
                  is_owner: true,
                  is_confirmed: true,
                },
                ...emails_to_invite.map((email) => {
                  return { email };
                }),
              ],
            },
          },
        },
      });

      const confirmationLink = `http://localhost:3333/trips/${trip.id}/confirm`;

      const mail = await getMailClient();

      const message = await mail.sendMail({
        from: {
          name: "Equipe plann.er",
          address: "oi@plann.er",
        },
        to: {
          name: owner_name,
          address: owner_email,
        },
        subject: `Confirme sua viagem para ${destination}`,
        html: `<div
  style="
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
  <h2 style="text-align: start; width: 100%">
    Olá ${owner_name}, recebemos sua solicitação!
  </h2>
  <h4 style="text-align: start; width: 100%">
    Você solicitou a criação de uma viagem para <strong>${destination}</strong>
  </h4>
  <p style="width: 100%">
    Na seguintes data: <br />Data de embarque <b>${dayjs(starts_at).format(
      "DD/MM/YYYY"
    )}</b><br />Data de
    retorno <b>${dayjs(ends_at).format("DD/MM/YYYY")}</b>
  </p>
  <p>Para confirmar a viagem clique no link abaixo</p>
  <a
    href="${confirmationLink}"
    style="
      padding: 10px 20px;
      background-color: rgb(0, 132, 255);
      text-decoration: none;
      color: white;
      border-radius: 5px;
    "
    >Confirme sua viagem</a
  >
  <p style="font-size: 12px; text-align: center">
    Caso não saiba do que se trata, pedimos desculpas pela confusão e que apenas
    ignore esse email.
  </p>
</div>
`.trim(),
      });

      console.log(nodemailer.getTestMessageUrl(message));
      return { tripId: trip.id };
    }
  );
}
