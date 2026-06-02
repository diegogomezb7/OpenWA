import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Persona } from './entities/persona.entity';
import { PersonaController } from './persona.controller';
import { PersonaService } from './persona.service';

@Module({
  imports: [TypeOrmModule.forFeature([Persona], 'data')],
  controllers: [PersonaController],
  providers: [PersonaService],
  exports: [TypeOrmModule],
})
export class PersonaModule {}
