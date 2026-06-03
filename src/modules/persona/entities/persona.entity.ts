import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('personas')
export class Persona {
  @PrimaryGeneratedColumn('uuid')
  id: string;


  @Column({ type: 'varchar', length: 255, nullable: true })
  nombres: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apellidos: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  numDoc: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  departamento: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  municipio: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipo: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefonoWap: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipoDocumento: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipoRegistro: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  clasificacionRegistro: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  TipoEstructuraRegistro: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
