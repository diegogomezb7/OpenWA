import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { Persona } from './entities/persona.entity';

@Injectable()
export class PersonaService {
  constructor(
    @InjectRepository(Persona, 'data')
    private readonly personaRepository: Repository<Persona>,
  ) {}

  async findAll(page: number = 1, limit: number = 10, search: string = ''): Promise<{ data: Persona[], total: number }> {
    const where: any[] = [];
    if (search) {
      where.push(
        { numDoc: ILike(`%${search}%`) },
        { nombres: ILike(`%${search}%`) },
        { telefono: ILike(`%${search}%`) }
      );
    }

    const [data, total] = await this.personaRepository.findAndCount({
      where: where.length > 0 ? where : {},
      order: {
        createdAt: 'DESC',
      },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total };
  }

  async createBatch(personas: Partial<Persona>[]): Promise<Persona[]> {
    // Convert numbers to strings and trim to avoid type mismatch from Excel
    const normalizedPersonas = personas.map(p => ({
      ...p,
      telefono: p.telefono != null ? String(p.telefono).trim() : '',
      numDoc: p.numDoc != null ? String(p.numDoc).trim() : '',
    }));

    // 1. Validation for telefono
    const validPersonas = normalizedPersonas.filter((p) => {
      // "si el telefono es numerico, debe ser de 10 digitos"
      if (p.telefono && /^\d+$/.test(p.telefono)) {
        if (p.telefono.length !== 10) {
          return false;
        }
      }
      return true;
    });

    // 2. Filter out duplicates by numDoc if numDoc is numeric
    const numericNumDocs = validPersonas
      .map((p) => p.numDoc)
      .filter((doc) => doc && /^\d+$/.test(doc)) as string[];

    let existingDocs = new Set<string>();
    if (numericNumDocs.length > 0) {
      const existingPersonas = await this.personaRepository.find({
        where: {
          numDoc: In(numericNumDocs),
        },
      });
      existingDocs = new Set(existingPersonas.map((p) => String(p.numDoc)));
    }

    const seenDocs = new Set<string>();
    const personasToSave = validPersonas.filter((p) => {
      if (p.numDoc && /^\d+$/.test(p.numDoc)) {
        if (existingDocs.has(p.numDoc) || seenDocs.has(p.numDoc)) {
          return false; // already in DB or already seen in this batch
        }
        seenDocs.add(p.numDoc);
      }
      return true;
    });

    if (personasToSave.length === 0) {
      return [];
    }

    const newPersonas = this.personaRepository.create(personasToSave);
    return this.personaRepository.save(newPersonas);
  }

  async delete(id: string): Promise<void> {
    await this.personaRepository.delete(id);
  }
}
