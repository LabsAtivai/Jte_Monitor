import "reflect-metadata";
import { NestFactory }    from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser       from "cookie-parser";
import { AppModule }      from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: ["https://ativa.law", "https://www.ativa.law", "http://207.244.249.157", "http://localhost:3000"],
    credentials: true,
  });
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 API em http://localhost:${port}`);
}
bootstrap();
