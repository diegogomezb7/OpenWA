import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PersonaService } from './persona.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('personas')
@Controller('personas')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @Get()
  @ApiOperation({ summary: 'List all personas with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = ''
  ) {
    return this.personaService.findAll(Number(page), Number(limit), search);
  }

  @Post('batch')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create multiple personas in batch' })
  async createBatch(@Body() personasData: any[]) {
    return this.personaService.createBatch(personasData);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete a persona by id' })
  async remove(@Param('id') id: string) {
    return this.personaService.delete(id);
  }
}
