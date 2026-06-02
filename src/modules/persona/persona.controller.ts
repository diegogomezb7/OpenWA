import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PersonaService } from './persona.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('personas')
@Controller('api/personas')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @Get()
  @ApiOperation({ summary: 'List all personas' })
  async findAll() {
    return this.personaService.findAll();
  }

  @Post('batch')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create multiple personas in batch' })
  async createBatch(@Body() personasData: any[]) {
    return this.personaService.createBatch(personasData);
  }
}
