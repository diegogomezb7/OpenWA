import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';

@Injectable()
export class PersonaService {
  constructor(
    @InjectRepository(Persona, 'data')
    private readonly personaRepository: Repository<Persona>,
  ) {}

  async findAll(): Promise<Persona[]> {
    return this.personaRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async createBatch(personas: Partial<Persona>[]): Promise<Persona[]> {
    const newPersonas = this.personaRepository.create(personas);
    return this.personaRepository.save(newPersonas);
  }
}
