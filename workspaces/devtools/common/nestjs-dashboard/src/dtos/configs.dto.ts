import { ApiProperty } from '@nestjs/swagger';

export class ConfigFileDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  path!: string;
}

export class ConfigDomainDto {
  @ApiProperty()
  domain!: string;

  @ApiProperty({ type: [ConfigFileDto] })
  files!: ConfigFileDto[];
}

export class ListConfigsResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: [ConfigDomainDto] })
  data!: ConfigDomainDto[];
}

export class GetConfigResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({
    description: 'The raw YAML content from the user override file',
  })
  rawUserConfig!: string;

  @ApiProperty({ description: 'The absolute path to the user override file' })
  userConfigPath!: string;

  @ApiProperty({ description: 'The raw YAML content from the default file' })
  rawDefaultConfig!: string;

  @ApiProperty({ description: 'The absolute path to the default file' })
  defaultConfigPath!: string;

  @ApiProperty({ description: 'The effective parsed configuration object' })
  effectiveConfig!: any;
}

export class SaveConfigRequestDto {
  @ApiProperty({ description: 'The raw YAML content to save as user override' })
  rawContent!: string;
}

export class SaveConfigResponseDto {
  @ApiProperty()
  success!: boolean;
}
