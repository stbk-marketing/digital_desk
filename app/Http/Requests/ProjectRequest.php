<?php

namespace App\Http\Requests;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('write', Project::class);
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        return [
            'request_id' => ['sometimes', 'uuid'],
            'name' => [$this->isMethod('post') ? 'required' : 'sometimes', 'required', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:50000'],
            'starts_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'ends_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'status' => ['sometimes', Rule::in(['active', 'completed', 'archived'])],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'expected_version' => [$this->isMethod('patch') ? 'required' : 'sometimes', 'integer', 'min:1'],
        ];
    }
}
