import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigsService } from '../services/configs.service';
import { GetConfigResponseDto, ListConfigsResponseDto, SaveConfigRequestDto, SaveConfigResponseDto } from '../dtos/configs.dto';

@ApiTags('configs')
@Controller('configs')
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available config domains and files' })
  @ApiResponse({ status: 200, type: ListConfigsResponseDto })
  listConfigs(): ListConfigsResponseDto {
    const data = this.configsService.getAvailableConfigs();
    return {
      success: true,
      data
    };
  }

  @Get(':domain/:name')
  @ApiOperation({ summary: 'Get details (effective, default, user) for a specific config' })
  @ApiResponse({ status: 200, type: GetConfigResponseDto })
  getConfigDetails(
    @Param('domain') domain: string,
    @Param('name') name: string
  ): GetConfigResponseDto {
    return this.configsService.getConfigDetails(domain, name);
  }

  @Put(':domain/:name')
  @ApiOperation({ summary: 'Save override yaml for a specific config' })
  @ApiResponse({ status: 200, type: SaveConfigResponseDto })
  saveConfig(
    @Param('domain') domain: string,
    @Param('name') name: string,
    @Body() body: SaveConfigRequestDto
  ): SaveConfigResponseDto {
    this.configsService.saveUserConfig(domain, name, body.rawContent);
    return { success: true };
  }
}
